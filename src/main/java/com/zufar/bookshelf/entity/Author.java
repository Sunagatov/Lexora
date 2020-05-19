package com.zufar.bookshelf.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import javax.persistence.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "Authors")
public class Author {

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false)
    private String imageLink;

    @Column(nullable = false, length = 50)
    private String fullName;

    @Column(length = 50)
    private String nickName;

    @Column(nullable = false) @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate birthday;

    @Column @DateTimeFormat(pattern = "yyyy-MM-dd")
    private LocalDate deathDay;

    @OneToOne
    @JoinColumn(name = "country_id")
    private Country country;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "Authors_Books",
            joinColumns = {@JoinColumn(name = "author_id")},
            inverseJoinColumns = {@JoinColumn(name = "book_id")}
    )
    private List<Book> books;

    @Override
    public String toString() {
        List<String> bookTitles = new ArrayList<>();
        if (this.books != null) {
            books.forEach(author -> bookTitles.add(author.getTitle()));
        }
        return "Author{" +
                "id=" + id +
                ", imageLink='" + imageLink + '\'' +
                ", fullName='" + fullName + '\'' +
                ", nickName='" + nickName + '\'' +
                ", birthday=" + birthday +
                ", deathDay=" + deathDay +
                ", country=" + country +
                ", books=" + bookTitles +
                '}';
    }
}
