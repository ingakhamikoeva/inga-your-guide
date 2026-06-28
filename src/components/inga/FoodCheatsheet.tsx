import React, { useState } from 'react';

const allProducts = [
  // БЕЛКИ - Мясо
  { name: 'Телятина', kcal: 90, cat: 'protein', color: 'green' },
  { name: 'Говядина вырезка', kcal: 110, cat: 'protein', color: 'yellow' },
  { name: 'Говядина нежирная', kcal: 140, cat: 'protein', color: 'yellow' },
  { name: 'Баранина молодая', kcal: 120, cat: 'protein', color: 'yellow' },
  { name: 'Свинина вырезка', kcal: 140, cat: 'protein', color: 'yellow' },
  { name: 'Мясо кролика нежирное', kcal: 140, cat: 'protein', color: 'yellow' },
  { name: 'Оленина', kcal: 150, cat: 'protein', color: 'yellow' },
  // БЕЛКИ - Птица
  { name: 'Куриное филе', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Индейка филе', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Индейка бедро', kcal: 140, cat: 'protein', color: 'yellow' },
  // БЕЛКИ - Субпродукты
  { name: 'Сердце говяжье', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Печень говяжья', kcal: 130, cat: 'protein', color: 'yellow' },
  { name: 'Печень куриная', kcal: 140, cat: 'protein', color: 'yellow' },
  // БЕЛКИ - Рыба нежирная
  { name: 'Минтай', kcal: 60, cat: 'protein', color: 'green' },
  { name: 'Треска', kcal: 70, cat: 'protein', color: 'green' },
  { name: 'Камбала', kcal: 70, cat: 'protein', color: 'green' },
  { name: 'Окунь речной', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Хек', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Щука', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Карась', kcal: 90, cat: 'protein', color: 'green' },
  { name: 'Окунь морской', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Палтус', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Сазан', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Сом', kcal: 120, cat: 'protein', color: 'yellow' },
  { name: 'Форель радужная', kcal: 120, cat: 'protein', color: 'yellow' },
  { name: 'Карп', kcal: 110, cat: 'protein', color: 'yellow' },
  { name: 'Лещ', kcal: 100, cat: 'protein', color: 'green' },
  { name: 'Ставрида', kcal: 110, cat: 'protein', color: 'yellow' },
  { name: 'Тунец', kcal: 140, cat: 'protein', color: 'yellow' },
  { name: 'Кета', kcal: 130, cat: 'protein', color: 'yellow' },
  { name: 'Горбуша', kcal: 140, cat: 'protein', color: 'yellow' },
  { name: 'Сельдь нежирная', kcal: 140, cat: 'protein', color: 'yellow' },
  { name: 'Форель речная', kcal: 150, cat: 'protein', color: 'yellow' },
  // БЕЛКИ - Морепродукты
  { name: 'Осьминог', kcal: 70, cat: 'protein', color: 'green' },
  { name: 'Кальмар', kcal: 90, cat: 'protein', color: 'green' },
  { name: 'Мидии', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Краб', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Креветка', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Раки', kcal: 80, cat: 'protein', color: 'green' },
  { name: 'Икра минтаевая', kcal: 130, cat: 'protein', color: 'yellow' },
  // БЕЛКИ - Молочные и яйца
  { name: 'Творог 0% мягкий', kcal: 40, cat: 'protein', color: 'green' },
  { name: 'Творог 0% зернистый', kcal: 70, cat: 'protein', color: 'green' },
  { name: 'Яичный белок 100г', kcal: 50, cat: 'protein', color: 'green' },
  { name: 'Яичный белок 1 шт', kcal: 20, cat: 'protein', color: 'green' },
  { name: 'Кефир 1%', kcal: 40, cat: 'protein', color: 'green' },
  { name: 'Йогурт 1,5%', kcal: 60, cat: 'protein', color: 'green' },
  { name: 'Молоко пастеризованное 1%', kcal: 40, cat: 'protein', color: 'green' },

  // УГЛЕВОДЫ - Фрукты и ягоды
  { name: 'Арбуз', kcal: 20, cat: 'carbs', color: 'green' },
  { name: 'Ежевика', kcal: 30, cat: 'carbs', color: 'green' },
  { name: 'Клюква', kcal: 30, cat: 'carbs', color: 'green' },
  { name: 'Лимон', kcal: 30, cat: 'carbs', color: 'green' },
  { name: 'Морошка', kcal: 30, cat: 'carbs', color: 'green' },
  { name: 'Облепиха', kcal: 30, cat: 'carbs', color: 'green' },
  { name: 'Абрикос', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Айва', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Алыча', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Апельсин', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Брусника', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Голубика', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Груша', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Дыня', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Земляника', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Кизил', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Клубника', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Крыжовник', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Малина', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Мандарин', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Персик', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Слива', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Смородина белая', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Смородина красная', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Смородина чёрная', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Черника', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Яблоки', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Грейпфрут', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Ананас', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Вишня', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Гранат', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Киви', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Рябина садовая', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Рябина черноплодная', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Черешня', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Шелковица', kcal: 50, cat: 'carbs', color: 'green' },
  { name: 'Инжир', kcal: 60, cat: 'carbs', color: 'green' },
  { name: 'Хурма', kcal: 60, cat: 'carbs', color: 'green' },
  { name: 'Зелёный горошек молодой', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Зелёный горошек', kcal: 70, cat: 'carbs', color: 'green' },
  { name: 'Виноград', kcal: 80, cat: 'carbs', color: 'green' },
  { name: 'Бананы', kcal: 90, cat: 'carbs', color: 'green' },
  { name: 'Картофель молодой', kcal: 40, cat: 'carbs', color: 'green' },
  { name: 'Картофель', kcal: 90, cat: 'carbs', color: 'green' },
  // УГЛЕВОДЫ - Крупы
  { name: 'Овсянка', kcal: null, cat: 'carbs', color: 'white', note: 'сухая 350 / варёная ~100 / запаренная ~50' },
  { name: 'Гречка', kcal: null, cat: 'carbs', color: 'white', note: 'сухая 330 / варёная ~110' },
  { name: 'Рис', kcal: null, cat: 'carbs', color: 'white', note: 'сухой 330 / варёный ~110' },
  { name: 'Макароны', kcal: null, cat: 'carbs', color: 'white', note: 'сухие 330 / варёные ~115' },
  { name: 'Перловка', kcal: null, cat: 'carbs', color: 'white', note: 'сухая 330 / варёная ~110' },
  { name: 'Пшено', kcal: null, cat: 'carbs', color: 'white', note: 'сухое 330 / варёное ~100' },
  { name: 'Геркулес', kcal: null, cat: 'carbs', color: 'white', note: 'сухой 350 / варёный ~90' },
  { name: 'Горох, фасоль', kcal: null, cat: 'carbs', color: 'white', note: 'сухие 330 / варёные ~110' },
  { name: 'Ячневая', kcal: null, cat: 'carbs', color: 'white', note: 'сухая 330 / варёная ~110' },
  // УГЛЕВОДЫ - Хлеб
  { name: 'Хлеб отрубной', kcal: 180, cat: 'carbs', color: 'red' },
  { name: 'Хлеб ржаной', kcal: 220, cat: 'carbs', color: 'red' },
  { name: 'Хлеб пшеничный', kcal: 250, cat: 'carbs', color: 'red' },
  { name: 'Батон', kcal: 230, cat: 'carbs', color: 'red' },
  { name: 'Баранки', kcal: 310, cat: 'carbs', color: 'red' },
  { name: 'Сушки', kcal: 330, cat: 'carbs', color: 'red' },
  { name: 'Сухари пшеничные', kcal: 400, cat: 'carbs', color: 'red' },
  { name: 'Сдобная выпечка', kcal: 300, cat: 'carbs', color: 'red' },
  // УГЛЕВОДЫ - Сладости и сухофрукты
  { name: 'Мармелад', kcal: 200, cat: 'carbs', color: 'red' },
  { name: 'Зефир', kcal: 300, cat: 'carbs', color: 'red' },
  { name: 'Мёд', kcal: 310, cat: 'carbs', color: 'red' },
  { name: 'Сахар', kcal: 400, cat: 'carbs', color: 'red' },
  { name: 'Чернослив', kcal: 260, cat: 'carbs', color: 'red' },
  { name: 'Курага', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Изюм', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Финики', kcal: 300, cat: 'carbs', color: 'red' },
  { name: 'Урюк', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Инжир сушёный', kcal: 280, cat: 'carbs', color: 'red' },

  // КЛЕТЧАТКА - Овощи
  { name: 'Огурцы', kcal: 10, cat: 'fiber', color: 'green' },
  { name: 'Сельдерей', kcal: 10, cat: 'fiber', color: 'green' },
  { name: 'Салат', kcal: 10, cat: 'fiber', color: 'green' },
  { name: 'Томаты', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Огурцы солёные', kcal: 10, cat: 'fiber', color: 'green' },
  { name: 'Томаты солёные', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Баклажаны', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Капуста квашеная', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Лук зелёный', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Редис', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Шпинат', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Морская капуста', kcal: 20, cat: 'fiber', color: 'green' },
  { name: 'Зелёная фасоль стручок', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Кабачки', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Капуста белокочанная', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Капуста цветная', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Морковь', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Перец зелёный', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Перец красный', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Редька', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Репа', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Тыква', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Щавель', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Черемша', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Брокколи', kcal: 40, cat: 'fiber', color: 'green' },
  { name: 'Брюква', kcal: 40, cat: 'fiber', color: 'green' },
  { name: 'Лук порей', kcal: 40, cat: 'fiber', color: 'green' },
  { name: 'Лук репчатый', kcal: 40, cat: 'fiber', color: 'green' },
  { name: 'Петрушка', kcal: 40, cat: 'fiber', color: 'green' },
  { name: 'Свекла', kcal: 40, cat: 'fiber', color: 'green' },
  { name: 'Хрен', kcal: 70, cat: 'fiber', color: 'green' },
  // КЛЕТЧАТКА - Грибы
  { name: 'Лисички', kcal: 15, cat: 'fiber', color: 'green' },
  { name: 'Шампиньоны', kcal: 15, cat: 'fiber', color: 'green' },
  { name: 'Опята', kcal: 15, cat: 'fiber', color: 'green' },
  { name: 'Маслята', kcal: 15, cat: 'fiber', color: 'green' },
  { name: 'Белые грибы', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Подберёзовики', kcal: 30, cat: 'fiber', color: 'green' },
  { name: 'Подосиновики', kcal: 30, cat: 'fiber', color: 'green' },

  // ЖИРЫ - Мясо жирное
  { name: 'Баранина 1 кат жирная', kcal: 210, cat: 'fat', color: 'red' },
  { name: 'Баранина 2 кат', kcal: 170, cat: 'fat', color: 'red' },
  { name: 'Говядина жирная', kcal: 220, cat: 'fat', color: 'red' },
  { name: 'Язык говяжий', kcal: 170, cat: 'fat', color: 'red' },
  { name: 'Свинина жирная', kcal: 370, cat: 'fat', color: 'red' },
  { name: 'Мясо кролика жирное', kcal: 180, cat: 'fat', color: 'red' },
  { name: 'Куриное бедро', kcal: 170, cat: 'fat', color: 'red' },
  { name: 'Гусь', kcal: 320, cat: 'fat', color: 'red' },
  // ЖИРЫ - Рыба жирная
  { name: 'Мойва', kcal: 160, cat: 'fat', color: 'red' },
  { name: 'Осётр', kcal: 160, cat: 'fat', color: 'red' },
  { name: 'Скумбрия', kcal: 190, cat: 'fat', color: 'red' },
  { name: 'Форель морская', kcal: 190, cat: 'fat', color: 'red' },
  { name: 'Семга', kcal: 200, cat: 'fat', color: 'red' },
  { name: 'Сайра', kcal: 200, cat: 'fat', color: 'red' },
  { name: 'Сельдь', kcal: 200, cat: 'fat', color: 'red' },
  { name: 'Стерлядь жирная', kcal: 320, cat: 'fat', color: 'red' },
  { name: 'Угорь речной', kcal: 330, cat: 'fat', color: 'red' },
  { name: 'Икра красная', kcal: 250, cat: 'fat', color: 'red' },
  // ЖИРЫ - Молочные
  { name: 'Молоко 3,5%', kcal: 60, cat: 'fat', color: 'green' },
  { name: 'Кефир 3,5%', kcal: 60, cat: 'fat', color: 'green' },
  { name: 'Простокваша 2,5%', kcal: 60, cat: 'fat', color: 'green' },
  { name: 'Ряженка 2,5%', kcal: 60, cat: 'fat', color: 'green' },
  { name: 'Сметана 10%', kcal: 120, cat: 'fat', color: 'yellow' },
  { name: 'Сливки 10%', kcal: 120, cat: 'fat', color: 'yellow' },
  { name: 'Молочное мороженое', kcal: 130, cat: 'fat', color: 'yellow' },
  { name: 'Мороженое сливочное', kcal: 180, cat: 'fat', color: 'red' },
  { name: 'Сливки 20%', kcal: 210, cat: 'fat', color: 'red' },
  { name: 'Сметана 20%', kcal: 210, cat: 'fat', color: 'red' },
  { name: 'Сыр плавленый', kcal: 220, cat: 'fat', color: 'red' },
  { name: 'Брынза', kcal: 260, cat: 'fat', color: 'red' },
  { name: 'Пломбир', kcal: 230, cat: 'fat', color: 'red' },
  { name: 'Творог жирный', kcal: 230, cat: 'fat', color: 'red' },
  { name: 'Сыр голландский', kcal: 350, cat: 'fat', color: 'red' },
  { name: 'Сыр пошехонский', kcal: 350, cat: 'fat', color: 'red' },
  { name: 'Сыр российский', kcal: 360, cat: 'fat', color: 'red' },
  { name: 'Сыр швейцарский', kcal: 390, cat: 'fat', color: 'red' },
  { name: 'Глазированные сырки', kcal: 400, cat: 'fat', color: 'red' },
  // ЖИРЫ - Яйца
  { name: 'Яичный желток 1 шт', kcal: 70, cat: 'fat', color: 'green' },
  { name: 'Яйцо куриное 100г', kcal: 150, cat: 'fat', color: 'yellow' },
  { name: 'Яичный желток 100г', kcal: 350, cat: 'fat', color: 'red' },
  // ЖИРЫ - Масла
  { name: 'Масло сливочное', kcal: 750, cat: 'fat', color: 'red' },
  { name: 'Масло растительное', kcal: 900, cat: 'fat', color: 'red' },
  { name: 'Масло топлёное', kcal: 900, cat: 'fat', color: 'red' },
  { name: 'Маргарин', kcal: 750, cat: 'fat', color: 'red' },
  { name: 'Майонез', kcal: 600, cat: 'fat', color: 'red' },
  { name: 'Шпик свиной', kcal: 820, cat: 'fat', color: 'red' },
  // ЖИРЫ - Орехи
  { name: 'Арахис', kcal: 550, cat: 'fat', color: 'red' },
  { name: 'Семечки подсолнечника', kcal: 580, cat: 'fat', color: 'red' },
  { name: 'Миндаль', kcal: 650, cat: 'fat', color: 'red' },
  { name: 'Грецкий орех', kcal: 650, cat: 'fat', color: 'red' },
  { name: 'Кедровый орех', kcal: 670, cat: 'fat', color: 'red' },
  { name: 'Фундук', kcal: 700, cat: 'fat', color: 'red' },
  { name: 'Халва подсолнечная', kcal: 520, cat: 'fat', color: 'red' },

  // ЖИРЫ - Дополнительные
  { name: 'Угорь морской', kcal: 90, cat: 'fat', color: 'green' },
  { name: 'Авокадо', kcal: 160, cat: 'fat', color: 'red' },
  { name: 'Сырки и масса творожные', kcal: 340, cat: 'fat', color: 'red' },
  { name: 'Брынза из коровьего молока', kcal: 260, cat: 'fat', color: 'red' },
  { name: 'Яйцо куриное 1 шт 60г', kcal: 90, cat: 'fat', color: 'green' },
  { name: 'Перепелиное яйцо 100г', kcal: 160, cat: 'fat', color: 'red' },
  { name: 'Жир кулинарный', kcal: 900, cat: 'fat', color: 'red' },
  // УГЛЕВОДЫ - Крупы дополнительные
  { name: 'Манная крупа', kcal: null, cat: 'carbs', color: 'white', note: 'сухая 330 / варёная ~80' },
  { name: 'Мука пшеничная 1 сорт', kcal: 330, cat: 'carbs', color: 'red' },
  { name: 'Мука пшеничная в/с', kcal: 330, cat: 'carbs', color: 'red' },
  { name: 'Мука ржаная', kcal: 330, cat: 'carbs', color: 'red' },
  // УГЛЕВОДЫ - Сладости дополнительные
  { name: 'Ирис', kcal: 380, cat: 'carbs', color: 'red' },
  { name: 'Хлеб пшеничный 1 сорт', kcal: 250, cat: 'carbs', color: 'red' },
  // УГЛЕВОДЫ - Сухофрукты дополнительные
  { name: 'Изюм с косточкой', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Кишмиш', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Вишня сушёная', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Груша сушёная', kcal: 250, cat: 'carbs', color: 'red' },
  { name: 'Персик сушёный', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Чернослив сушёный', kcal: 260, cat: 'carbs', color: 'red' },
  { name: 'Яблоки сушёные', kcal: 280, cat: 'carbs', color: 'red' },
  { name: 'Папайя сушёная', kcal: 340, cat: 'carbs', color: 'red' },
  { name: 'Клубника сушёная', kcal: 280, cat: 'carbs', color: 'red' },
];

const catLabels: Record<string, string> = {
  protein: 'Белки',
  carbs: 'Углеводы',
  fiber: 'Клетчатка',
  fat: 'Жиры',
};

const dotColors: Record<string, string> = {
  green: '#5E9E72',
  yellow: '#C49A3E',
  red: '#C0614A',
  white: 'transparent',
};

export function FoodCheatsheet({ onBack }: { onBack: () => void }) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = allProducts.filter(p => {
    const matchCat = filter === 'all' || p.cat === filter;
    const matchQ = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  const filters = [
    { id: 'all', label: 'Все' },
    { id: 'protein', label: 'Белки' },
    { id: 'carbs', label: 'Углеводы' },
    { id: 'fiber', label: 'Клетчатка' },
    { id: 'fat', label: 'Жиры' },
  ];

  return (
    <div className="pb-8">
      <button onClick={onBack} className="text-base text-muted-foreground mb-6 block">← Назад</button>
      <h2 className="text-2xl font-bold mb-1">Шпаргалка по продуктам</h2>
      <p className="text-sm text-muted-foreground mb-5">Калорийность на 100 г</p>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">🔍</span>
        <input
          type="text"
          placeholder="Найти продукт..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm"
        />
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap mb-4">
        {[
          { color: '#5E9E72', label: 'до 100 ккал' },
          { color: '#C49A3E', label: '101–150 ккал' },
          { color: '#C0614A', label: 'от 151 ккал' },
          { color: 'transparent', label: 'зависит от приготовления', border: true },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: l.color,
                border: l.border ? '1.5px solid #888' : 'none',
                flexShrink: 0,
              }}
            />
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-2 border-b border-border" style={{ gridTemplateColumns: '20px 1fr 80px 60px' }}>
          <div></div>
          <div>Продукт</div>
          <div className="text-center">Тип</div>
          <div className="text-right">ккал/100г</div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">Ничего не найдено</div>
        ) : (
          filtered.map((p, i) => (
            <div
              key={i}
              className="grid items-center px-3 py-2.5 border-b border-border last:border-0"
              style={{ gridTemplateColumns: '20px 1fr 80px 60px' }}
            >
              <div
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: dotColors[p.color],
                  border: p.color === 'white' ? '1.5px solid #888' : 'none',
                  flexShrink: 0,
                }}
              />
              <div>
                <p className="text-sm">{p.name}</p>
                {p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
              </div>
              <div className="text-center">
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {catLabels[p.cat]}
                </span>
              </div>
              <div className="text-right text-sm font-medium text-muted-foreground">
                {p.kcal ?? '—'}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        {filtered.length} продуктов
      </p>
    </div>
  );
}
